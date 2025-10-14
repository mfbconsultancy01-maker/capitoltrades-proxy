export default function handler(req, res) {
  return res.status(200).json({
    ok: true,
    route: "ptr",
    message: "PTR endpoint is working"
  });
}
