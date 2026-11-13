import PhoenixTabs from "./PhoenixTabs";

export default function PhoenixLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <PhoenixTabs />
      {children}
    </div>
  );
}
