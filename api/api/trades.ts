export default function handler(req, res) {
  return res.status(200).json({
    ok: true,
    service: "capitoltrades-proxy-trades",
    message: "Trades endpoint is working!"
  });
}
