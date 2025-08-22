import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "NotifyNL Verification Service",
    description: "API Docs",
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}