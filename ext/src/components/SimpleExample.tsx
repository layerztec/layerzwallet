import React from 'react';
import { ThemedText } from './ThemedText';

export function SimpleExample() {
  return (
    <div
      style={{
        padding: '16px',
        backgroundColor: '#f5f5f5',
        borderRadius: '8px',
        margin: '10px 0',
      }}
    >
      <ThemedText type="headline">Simple Headline</ThemedText>
      <div style={{ marginTop: '8px' }}>
        <ThemedText type="paragraph">This is a simple paragraph text without Tamagui's complexity.</ThemedText>
      </div>
      <div style={{ marginTop: '8px' }}>
        <ThemedText type="link">This is a link text</ThemedText>
      </div>
      <div style={{ marginTop: '8px' }}>
        <ThemedText type="defaultSemiBold">This text is bold</ThemedText>
      </div>
      <div style={{ marginTop: '8px' }}>
        <ThemedText lightColor="#FD5D2B" darkColor="#9DF9EC">
          This text has custom colors
        </ThemedText>
      </div>
    </div>
  );
}
