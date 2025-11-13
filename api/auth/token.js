export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { code, redirect_uri } = req.body;
  
  if (!code || !redirect_uri) {
    return res.status(400).json({ error: 'Faltan parámetros requeridos' });
  }

  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: redirect_uri
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('Error de Google:', data);
      return res.status(response.status).json({ 
        error: data.error || 'Error en autenticación' 
      });
    }

    res.json(data);
  } catch (error) {
    console.error('Error en endpoint /api/auth/token:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}