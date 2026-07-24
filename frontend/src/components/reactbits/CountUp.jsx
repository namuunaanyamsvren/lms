import { useEffect, useRef, useState } from 'react';
import { useInView, useMotionValue, useSpring } from 'framer-motion';

export default function CountUp({
  from = 0,
  to,
  direction = 'up',
  delay = 0,
  duration = 2,
  className = '',
  startWhenInView = true,
  separator = '',
  decimals = 0,
  prefix = '',
  suffix = '',
  onStart,
  onEnd,
}) {
  const ref = useRef(null);
  const motionValue = useMotionValue(direction === 'down' ? to : from);

  const damping = 20 + 40 * (1 / duration);
  const stiffness = 100 * (1 / duration);

  const springValue = useSpring(motionValue, {
    damping,
    stiffness,
  });

  const isInView = useInView(ref, { once: true, margin: '0px 0px -50px 0px' });
  const [displayValue, setDisplayValue] = useState(
    direction === 'down' ? to : from
  );

  useEffect(() => {
    if (ref.current) {
      if (startWhenInView && isInView) {
        startAnimation();
      } else if (!startWhenInView) {
        startAnimation();
      }
    }
  }, [isInView, startWhenInView]);

  const startAnimation = () => {
    if (onStart) onStart();
    const timeoutId = setTimeout(() => {
      motionValue.set(direction === 'down' ? from : to);
    }, delay * 1000);

    return () => clearTimeout(timeoutId);
  };

  useEffect(() => {
    const unsubscribe = springValue.on('change', (latest) => {
      const formatted = Number(latest).toFixed(decimals);
      const parts = formatted.split('.');
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, separator);
      setDisplayValue(parts.join('.'));

      if (latest === (direction === 'down' ? from : to) && onEnd) {
        onEnd();
      }
    });

    return () => unsubscribe();
  }, [springValue, decimals, separator, direction, from, to, onEnd]);

  return (
    <span ref={ref} className={`inline-block tab-nums ${className}`}>
      {prefix}
      {displayValue}
      {suffix}
    </span>
  );
}
