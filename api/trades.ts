export default function handler(req, res) {
  return res.status(200).json({
    ok: true,
    route: "trades",
    message: "Trades endpoint is working"
  });
}
