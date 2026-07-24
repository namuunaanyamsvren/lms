import { motion } from 'framer-motion';

export default function FadeContent({
  children,
  blur = true,
  duration = 0.6,
  easing = [0.25, 0.1, 0.25, 1],
  delay = 0,
  threshold = 0.1,
  initialOpacity = 0,
  distance = 30,
  className = '',
  once = true,
  ...props
}) {
  return (
    <motion.div
      initial={{
        opacity: initialOpacity,
        y: distance,
        filter: blur ? 'blur(10px)' : 'blur(0px)',
      }}
      whileInView={{
        opacity: 1,
        y: 0,
        filter: 'blur(0px)',
      }}
      viewport={{ once, amount: threshold }}
      transition={{
        duration,
        delay,
        ease: easing,
      }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}
