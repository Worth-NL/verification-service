"use client"
import { RedocStandalone } from 'redoc';

export default function RedocViewer() {
  return (
    <RedocStandalone
      specUrl="/api/swagger"
      options={{
        nativeScrollbars: true
      }}
    />
  );
}