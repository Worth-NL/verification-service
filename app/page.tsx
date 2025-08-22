"use client";
import React, { useEffect } from "react";

export default function RedocViewer() {
  useEffect(() => {
    const script = document.createElement("script");
    script.src =
      "https://cdn.jsdelivr.net/npm/redoc@next/bundles/redoc.standalone.js";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  return (
    <div style={{ height: "100vh" }}>
      {React.createElement("redoc", { "spec-url": "/api/swagger" })}
    </div>
  );
}