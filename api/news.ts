export default function handler(req, res) {
  return res.status(200).json({
    ok: true,
    route: "news",
    message: "News endpoint is working"
  });
}
