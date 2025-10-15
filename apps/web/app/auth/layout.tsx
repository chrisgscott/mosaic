export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Auth pages handle their own layout, just pass through
  return <>{children}</>;
}
