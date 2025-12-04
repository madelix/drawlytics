// client/src/components/ScrollToTopButton.tsx
import { useEffect, useState } from 'react';

export function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (typeof window === 'undefined') return;
      setVisible(window.scrollY > 300);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      className="dl-scroll-top"
      onClick={() =>
        window.scrollTo({
          top: 0,
          behavior: 'smooth',
        })
      }
    >
      ↑ Back to top
    </button>
  );
}

export default ScrollToTopButton;
