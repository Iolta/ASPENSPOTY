const fs = require('fs');

// La URL exacta que descubriste en la pestaña de red
const API_URL = 'https://np.tritondigital.com/public/nowplaying?mountName=ASPEN&numberToFetch=1';
const MEMORIA_FILE = 'ultimo_tema.txt';

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const SPOTIFY_PLAYLIST_ID = process.env.SPOTIFY_PLAYLIST_ID;

async function monitorearAspen() {
  try {
    // 1. Consultamos la URL oficial de Triton
    const respuesta = await fetch(API_URL);
    if (!respuesta.ok) throw new Error(`HTTP Error: ${respuesta.status}`);
    
    const textoXML = await respuesta.text();
    
    // Extraemos artista y título usando expresiones regulares simples sobre el XML
    const artistaMatch = textoXML.match(/<property name="track_artist_name"><!\[CDATA\[(.*?)]]><\/property>/);
    const tituloMatch = textoXML.match(/<property name="cue_title"><!\[CDATA\[(.*?)]]><\/property>/);
    
    const artista = artistaMatch ? artistaMatch[1].trim() : "";
    const titulo = tituloMatch ? tituloMatch[1].trim() : "";
    
    if (!artista || !titulo) {
      console.log("Triton no reporta canción en este momento (puede ser tanda comercial).");
      return;
    }
    
    const cancionCompleta = `${artista} - ${titulo}`;
    
    // Filtro para ignorar separadores de la radio
    if (cancionCompleta.toUpperCase().includes("ASPEN")) {
      console.log("Separador institucional o tanda: " + cancionCompleta);
      return;
    }
    
    // 2. Control de memoria local para no duplicar
    let ultimoTema = "";
    if (fs.existsSync(MEMORIA_FILE)) {
      ultimoTema = fs.readFileSync(MEMORIA_FILE, 'utf-8').trim();
    }
    
    if (cancionCompleta === ultimoTema) {
      console.log("Sigue sonando el mismo tema: " + cancionCompleta);
      return;
    }
    
    // Guardamos en memoria
    fs.writeFileSync(MEMORIA_FILE, cancionCompleta);
    console.log(`¡¡NUEVO TEMA DETECTADO EN ASPEN!!: ${cancionCompleta}`);
    
    // 3. Si están las claves de Spotify cargadas, impactamos la playlist
    if (SPOTIFY_CLIENT_ID && SPOTIFY_CLIENT_SECRET && SPOTIFY_PLAYLIST_ID) {
      await agregarASpotify(titulo, artista);
    } else {
      console.log("Motor de radio validado con éxito. Falta cargar las credenciales de Spotify en los Secrets de GitHub.");
    }
    
  } catch (error) {
    console.error("Error en el monitoreo:", error.message);
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
      console.log(`¡¡Agregado con éxito a tu playlist de Spotify!! 🎵`);
    } else {
      console.error(`Error al añadir track a Spotify. Código Status: ${agregarRes.status}`);
    }

  } catch (err) {
    console.error("Error interactuando con Spotify:", err.message);
  }
}

monitorearAspen();
