import { motion } from 'framer-motion';
import { useRef } from 'react';

export default function BlurText({
  text = '',
  delay = 150,
  className = '',
  animateBy = 'words', // 'words' or 'letters'
  direction = 'bottom', // 'top' or 'bottom'
  threshold = 0.1,
  rootMargin = '0px',
  animationFrom,
  animationTo,
  easing = [0.25, 0.1, 0.25, 1],
  once = true,
  as: Component = 'p',
}) {
  const elements = animateBy === 'words' ? text.split(' ') : text.split('');
  const ref = useRef(null);

  const defaultFrom =
    direction === 'top'
      ? { filter: 'blur(10px)', opacity: 0, transform: 'translate3d(0,-30px,0)' }
      : { filter: 'blur(10px)', opacity: 0, transform: 'translate3d(0,30px,0)' };

  const defaultTo = [
    {
      filter: 'blur(5px)',
      opacity: 0.5,
      transform:
        direction === 'top' ? 'translate3d(0,5px,0)' : 'translate3d(0,-5px,0)',
    },
    { filter: 'blur(0px)', opacity: 1, transform: 'translate3d(0,0,0)' },
  ];

  const from = animationFrom || defaultFrom;
  const to = animationTo || defaultTo;

  return (
    <Component ref={ref} className={`inline-flex flex-wrap ${className}`}>
      {elements.map((element, index) => (
        <motion.span
          key={index}
          initial={from}
          whileInView={to}
          viewport={{ once, amount: threshold, margin: rootMargin }}
          transition={{
            duration: 0.5,
            delay: (index * delay) / 1000,
            ease: easing,
          }}
          className="inline-block whitespace-pre"
        >
          {element === ' ' ? '\u00A0' : element}
          {animateBy === 'words' && index < elements.length - 1 && '\u00A0'}
        </motion.span>
      ))}
    </Component>
  );
}
