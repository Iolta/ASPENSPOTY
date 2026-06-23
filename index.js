const fs = require('fs');

const API_URL = 'https://np.tritondigital.com/public/nowplaying?mountName=ASPEN&numberToFetch=1';
const MEMORIA_FILE = 'ultimo_tema.txt';
const CONTROL_FECHA_FILE = 'ultima_limpieza.txt'; 

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const SPOTIFY_PLAYLIST_ID = process.env.SPOTIFY_PLAYLIST_ID;

function obtenerFechaOperativaArgentina() {
  const ahora = new Date();
  const utc = ahora.getTime() + (ahora.getTimezoneOffset() * 60000);
  const horaArg = new Date(utc + (3600000 * -3));
  
  const horas = horaArg.getHours();
  
  if (horas < 4) {
    horaArg.setDate(horaArg.getDate() - 1);
  }
  
  return horaArg.toISOString().split('T')[0];
}

async function monitorearAspen() {
  try {
    const respuesta = await fetch(API_URL);
    if (!respuesta.ok) throw new Error(`HTTP Error: ${respuesta.status}`);
    const textoXML = await respuesta.text();
    
    const artistaMatch = textoXML.match(/<property name="track_artist_name"><!\[CDATA\[(.*?)]]><\/property>/);
    const tituloMatch = textoXML.match(/<property name="cue_title"><!\[CDATA\[(.*?)]]><\/property>/);
    
    const artista = artistaMatch ? artistaMatch[1].trim() : "";
    const titulo = tituloMatch ? tituloMatch[1].trim() : "";
    
    if (!artista || !titulo) {
      console.log("No hay canción reportada en este momento.");
      return;
    }
    
    const cancionCompleta = `${artista} - ${titulo}`;
    if (cancionCompleta.toUpperCase().includes("ASPEN")) {
      console.log("Separador o tanda ignorado: " + cancionCompleta);
      return;
    }
    
    let ultimoTema = "";
    if (fs.existsSync(MEMORIA_FILE)) {
      ultimoTema = fs.readFileSync(MEMORIA_FILE, 'utf-8').trim();
    }
    
    if (cancionCompleta === ultimoTema) {
      console.log("Sigue sonando: " + cancionCompleta);
      return;
    }
    
    fs.writeFileSync(MEMORIA_FILE, cancionCompleta);
    console.log(`¡¡NUEVO TEMA DETECTADO!!: ${cancionCompleta}`);
    
    if (SPOTIFY_CLIENT_ID && SPOTIFY_CLIENT_SECRET && SPOTIFY_PLAYLIST_ID) {
      await procesarSpotify(titulo, artista);
    } else {
      console.log("Claves de Spotify no detectadas en el entorno.");
    }
    
  } catch (error) {
    console.error("Error en monitoreo:", error.message);
  }
}

async function procesarSpotify(titulo, artista) {
  try {
    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });
    const tokenDatos = await tokenRes.json();
    const token = tokenDatos.access_token;
    if (!token) return console.error("Error de token.");

    const fechaOperativaActual = obtenerFechaOperativaArgentina();
    let ultimaLimpieza = "";
    if (fs.existsSync(CONTROL_FECHA_FILE)) {
      ultimaLimpieza = fs.readFileSync(CONTROL_FECHA_FILE, 'utf-8').trim();
    }

    if (fechaOperativaActual !== ultimaLimpieza) {
      console.log(`🔄 Nueva jornada detectada (${fechaOperativaActual}). Vaciando playlist para arrancar de cero...`);
      
      await fetch(`https://api.spotify.com/v1/playlists/${SPOTIFY_PLAYLIST_ID}/tracks`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ uris: [] })
      });
      
      fs.writeFileSync(CONTROL_FECHA_FILE, fechaOperativaActual);
    }

    const query = encodeURIComponent(`track:${titulo} artist:${artista}`);
    const buscarRes = await fetch(`https://api.spotify.com/v1/search?q=${query}&type=track&limit=1`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const buscarDatos = await buscarRes.json();

    if (!buscarDatos.tracks || buscarDatos.tracks.items.length === 0) {
      return console.log(`No se encontró "${titulo}" de ${artista} en el catálogo de Spotify.`);
    }

    const trackUri = buscarDatos.tracks.items[0].uri;
    console.log(`Encontrado en Spotify: ${buscarDatos.tracks.items[0].name} (${trackUri})`);

    const agregarRes = await fetch(`https://api.spotify.com/v1/playlists/${SPOTIFY_PLAYLIST_ID}/tracks`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ uris: [trackUri] })
    });

    if (agregarRes.status === 201 || agregarRes.status === 200) {
      console.log(`¡¡Agregado con éxito a tu playlist de Spotify!! 🎵`);
    } else {
      const errorDetalle = await agregarRes.text();
      console.error(`Error al añadir track. Status: ${agregarRes.status}. Detalle: ${errorDetalle}`);
    }

  } catch (err) {
    console.error("Error en Spotify:", err.message);
  }
}

monitorearAspen();
