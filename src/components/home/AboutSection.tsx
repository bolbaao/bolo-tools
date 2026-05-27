const cards = [
  {
    title: "未来计划",
    lines: ["我们会继续优化工具体验，", "增加更多实用功能。"],
  },
  {
    title: "联系与反馈",
    lines: [
      "如果你有功能建议、合作想法或使用反馈，",
      "欢迎联系我们。",
      "你的每一次建议，都会帮助春雨盒变得更好。",
    ],
  },
];

export default function AboutSection() {
  return (
    <section id="about" className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 lg:px-8">
      <div className="reveal mx-auto max-w-2xl text-center">
        <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">关于春雨集</h2>
        <p className="mt-4 text-base leading-relaxed text-white/45 sm:text-lg">
          一个把好用、好玩、好看的工具装在一起的小站。
        </p>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6">
        {cards.map((card, index) => (
          <article
            key={card.title}
            className="about-card reveal"
            style={{ transitionDelay: `${0.1 + index * 0.08}s` }}
          >
            <h3 className="text-base font-semibold tracking-tight text-white/90">{card.title}</h3>
            <p className="mt-4 space-y-1 text-sm leading-relaxed text-white/42">
              {card.lines.map((line, i) => (
                <span key={i} className="block">
                  {line}
                </span>
              ))}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
