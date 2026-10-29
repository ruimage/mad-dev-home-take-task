import { createContext, useContext, type ReactNode } from "react";
import { ServiceContainer, type ServiceToken } from "./container";

const ContainerContext = createContext<ServiceContainer | null>(null);

export function ContainerProvider({
  container,
  children,
}: {
  container: ServiceContainer;
  children: ReactNode;
}) {
  return <ContainerContext.Provider value={container}>{children}</ContainerContext.Provider>;
}

/** Resolves a service by token from the nearest `ContainerProvider`. */
export function useService<T>(token: ServiceToken<T>): T {
  const container = useContext(ContainerContext);
  if (container === null) {
    throw new Error("useService must be used within a <ContainerProvider>");
  }
  return container.resolve(token);
}
