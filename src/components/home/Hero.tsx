import HeroAiChat from "@/components/home/HeroAiChat";

export default function Hero() {
  return (
    <section className="relative mx-auto max-w-4xl px-4 pt-20 pb-12 text-center sm:px-6 sm:pt-28 sm:pb-16 lg:pt-32 lg:pb-20">
      <h1 className="reveal text-[2.25rem] font-semibold leading-[1.12] tracking-tight text-white sm:text-5xl lg:text-[3.25rem]">
        <span className="block">把日常</span>
        <span className="block">变得更有想象力</span>
      </h1>

      <p className="reveal reveal-d1 mx-auto mt-6 max-w-md text-base leading-relaxed text-white/45 sm:text-lg">
        日常小事，也可以很好玩。
      </p>

      <HeroAiChat />
    </section>
  );
}
