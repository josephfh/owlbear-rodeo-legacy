import React, { useRef, useEffect, useState } from "react";
import { Rect, Text, Group } from "react-konva";

function TokenLabel({ tokenState, width, height }) {
  const fontSize = height / 6 / tokenState.size;
  const paddingY = height / 16 / tokenState.size;
  const paddingX = height / 8 / tokenState.size;

  const [rectWidth, setRectWidth] = useState(0);
  useEffect(() => {
    const text = textRef.current;
    if (text && tokenState.label) {
      setRectWidth(text.getTextWidth() + paddingX);
    } else {
      setRectWidth(0);
    }
  }, [tokenState.label, paddingX]);

  const textRef = useRef();

  return (
    <Group y={height - (fontSize + paddingY) / 2}>
      <Rect
        y={-paddingY / 2}
        width={rectWidth}
        offsetX={width / 2}
        x={width - rectWidth / 2}
        height={fontSize + paddingY}
        fill="hsla(230, 25%, 18%, 0.8)"
        cornerRadius={(fontSize + paddingY) / 2}
      />
      <Text
        ref={textRef}
        width={width}
        text={tokenState.label}
        fontSize={fontSize}
        lineHeight={1}
        align="center"
        verticalAlign="bottom"
        fill="white"
        paddingX={paddingX}
        paddingY={paddingY}
        wrap="none"
        ellipsis={true}
      />
    </Group>
  );
}

export default TokenLabel;
