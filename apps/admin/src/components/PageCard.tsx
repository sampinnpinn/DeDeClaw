import type { ReactNode } from 'react';
import styles from './PageCard.module.css';

interface PageCardProps {
  title: string;
  children: ReactNode;
}

export default function PageCard({ title, children }: PageCardProps) {
  return (
    <section className={styles.card}>
      <h3 className={styles.title}>{title}</h3>
      {children}
    </section>
  );
}
