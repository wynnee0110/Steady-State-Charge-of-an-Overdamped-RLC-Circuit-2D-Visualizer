import React, { useMemo } from 'react';
import katex from 'katex';

interface MathTexProps {
  tex: string;
  display?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const MathTex: React.FC<MathTexProps> = ({
  tex,
  display = false,
  className,
  style,
}) => {
  const html = useMemo(
    () =>
      katex.renderToString(tex, {
        displayMode: display,
        throwOnError: false,
        strict: false,
      }),
    [tex, display]
  );

  if (display) {
    return (
      <div
        className={className}
        style={style}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  return (
    <span
      className={className}
      style={style}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};
