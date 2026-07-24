import { motion } from 'framer-motion';

export default function SplitText({
  text = '',
  className = '',
  delay = 50,
  duration = 0.5,
  ease = [0.25, 0.1, 0.25, 1],
  threshold = 0.1,
  once = true,
  as: Component = 'h2',
}) {
  const words = text.split(' ');

  return (
    <Component className={`inline-flex flex-wrap ${className}`}>
      {words.map((word, wordIndex) => (
        <span key={wordIndex} className="inline-block overflow-hidden pb-1 pr-2">
          <motion.span
            initial={{ y: '100%', opacity: 0, filter: 'blur(4px)' }}
            whileInView={{ y: '0%', opacity: 1, filter: 'blur(0px)' }}
            viewport={{ once, amount: threshold }}
            transition={{
              duration,
              delay: (wordIndex * delay) / 1000,
              ease,
            }}
            className="inline-block"
          >
            {word}
          </motion.span>
        </span>
      ))}
    </Component>
  );
}
