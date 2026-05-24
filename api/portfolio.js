export function GET() {
  return Response.json({
    name: "余建德 Jarod Yu",
    role: "短影音企劃｜社群帳號經營｜AI 工作流導入",
    status: "Vercel Serverless API is running",
    contact: {
      email: "wwd10925@gmail.com",
      instagram: "https://www.instagram.com/jarod.0824/"
    },
    highlights: [
      "最高觀看 7M+",
      "單支影片 1K+ 粉絲增加",
      "3 個月 IG 粉絲增加近 8000"
    ]
  });
}

