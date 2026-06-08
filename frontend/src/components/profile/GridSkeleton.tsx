interface Props {
  count?: number;
}

/** Placeholders con shimmer mientras carga la siguiente página de la grilla. */
export function GridSkeleton({ count = 6 }: Props) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="skeleton-shimmer"
          style={{ aspectRatio: "1", borderRadius: 0 }}
        />
      ))}
    </>
  );
}
