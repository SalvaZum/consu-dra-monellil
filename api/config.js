export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  
  res.json({
    clientId: process.env.GOOGLE_CLIENT_ID,
    // NO enviar clientSecret
  });
}