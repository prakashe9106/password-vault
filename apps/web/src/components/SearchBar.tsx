interface Props {
  value: string;
  onChange: (value: string) => void;
}

export default function SearchBar({ value, onChange }: Props) {
  return (
    <input
      type="search"
      placeholder="Search logins…"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ maxWidth: 320 }}
    />
  );
}
