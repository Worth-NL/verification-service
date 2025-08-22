import React from "react";

declare global {
    namespace JSX {
        interface IntrinsicElements {
            redoc: React.DetailedHTMLProps<
                React.HTMLAttributes<HTMLElement>,
                HTMLElement
            > & {
                "spec-url": string; // required for Redoc
                "scroll-y-offset"?: number;
                "theme"?: Record<string, any>;
            };
        }
    }
}