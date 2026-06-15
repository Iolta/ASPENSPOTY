const fs = require('fs');

// Nueva API oficial blindada y directa
const API_URL = 'https://nowplaying.misionesonline.net/aspen.json';
const MEMORIA_FILE = 'ultimo_tema.txt';

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const SPOTIFY_PLAYLIST_ID = process.env.SPOTIFY_PLAYLIST_ID;

async function monitorearAspen() {
  try {
    // 1. Consultar el tema actual
    const respuesta = await fetch(API_URL);
    if (!respuesta.ok) throw new Error(`HTTP error! status: ${respuesta.status}`);
    
    const datos = await respuesta.json();
    
    // Adaptación a la estructura limpia del JSON oficial
    const artista = datos.artist ? datos.artist.trim() : "";
    const titulo = datos.title ? datos.title.trim() : "";
    
    if (!artista || !titulo) {
      console.log("La radio no reporta canción en este momento (puede ser tanda comercial).");
      return;
    }
    
    const cancionCompleta = `${artista} - ${titulo}`;
    
    if (cancionCompleta.toUpperCase().includes("ASPEN") || cancionCompleta.toUpperCase().includes("VIVI ASPEN")) {
      console.log("Separador institucional o tanda: " + cancionCompleta);
      return;
    }
    
    // 2. Control de memoria local
    let ultimoTema = "";
    if (fs.existsSync(MEMORIA_FILE)) {
      ultimoTema = fs.readFileSync(MEMORIA_FILE, 'utf-8').trim();
    }
    
    if (cancionCompleta === ultimoTema) {
      console.log("Sigue sonando el mismo tema: " + cancionCompleta);
      return;
    }
    
    // Guardamos en la memoria del repositorio
    fs.writeFileSync(MEMORIA_FILE, cancionCompleta);
    console.log(`¡¡NUEVO TEMA DETECTADO EN RADIO!!: ${cancionCompleta}`);
    
    // 3. Impactar en Spotify si las credenciales existen
    if (SPOTIFY_CLIENT_ID && SPOTIFY_CLIENT_SECRET && SPOTIFY_PLAYLIST_ID) {
      await agregarASpotify(titulo, artista);
    } else {
      console.log("Claves de Spotify no configuradas aún. Motor de radio validado con éxito.");
    }
    
  } catch (error) {
    console.error("Error al consultar la radio:", error.message);
  }
}

async function agregarASpotify(titulo, artista) {
  try {
    const authOptions = {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    };
    
    const tokenRes = await fetch('https://accounts.spotify.com/api/token', authOptions);
    const tokenDatos = await tokenRes.json();
    const token = tokenDatos.access_token;

    if (!token) {
      console.error("No se pudo obtener el token de Spotify.");
      return;
    }

    const query = encodeURIComponent(`track:${titulo} artist:${artista}`);
    const buscarRes = await fetch(`https://api.spotify.com/v1/search?q=${query}&type=track&limit=1`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const buscarDatos = await buscarRes.json();

    if (!buscarDatos.tracks || buscarDatos.tracks.items.length === 0) {
      console.log(`No se encontró "${titulo}" de ${artista} en Spotify.`);
      return;
    }

    const trackUri = buscarDatos.tracks.items[0].uri;
    console.log(`Encontrado en Spotify: ${buscarDatos.tracks.items[0].name} (${trackUri})`);

    const agregarRes = await fetch(`https://api.spotify.com/v1/playlists/${SPOTIFY_PLAYLIST_ID}/tracks`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ uris: [trackUri] })
    });

    if (agregarRes.status === 201 || agregarRes.status === 200) {
      console.log(`¡¡Agregado con éxito a tu playlist!! 🎵`);
    } else {
      console.error(`Error al añadir track. Status: ${agregarRes.status}`);
    }

  } catch (err) {
    console.error("Error en Spotify:", err.message);
  }
}

monitorearAspen();
