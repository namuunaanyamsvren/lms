import FadeContent from '../reactbits/FadeContent';

export default function SectionHeading({ eyebrow, title, description, align = 'left' }) {
  return (
    <FadeContent distance={25} duration={0.6} blur={true} className={`max-w-2xl ${align === 'center' ? 'mx-auto text-center' : ''}`}>
      {eyebrow && (
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-indigo-600 mb-3">
          {eyebrow}
        </p>
      )}
      <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-slate-950">
        {title}
      </h2>
      {description && (
        <p className="mt-4 text-base leading-8 text-slate-600">
          {description}
        </p>
      )}
    </FadeContent>
  );
}

