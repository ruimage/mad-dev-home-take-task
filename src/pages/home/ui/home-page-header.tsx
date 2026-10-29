export function HomePageHeader() {
  return (
    <header className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
        Одна комната · один рабочий день
      </p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Бронирование переговорной
      </h1>
      <p className="text-sm text-muted-foreground">
        Выберите день и свободное время. Рабочие часы: 09:00–18:00.
      </p>
    </header>
  );
}
