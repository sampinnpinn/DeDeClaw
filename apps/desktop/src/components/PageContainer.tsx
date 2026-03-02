import { ReactNode, CSSProperties } from 'react';

interface PageContainerProps {
  pageId: string;
  currentPage: string;
  children: ReactNode;
}

function PageContainer({ pageId, currentPage, children }: PageContainerProps) {
  const isActive = pageId === currentPage;
  
  const style: CSSProperties = {
    display: isActive ? 'flex' : 'none',
    flex: 1,
    height: '100%',
  };

  return (
    <div style={style}>
      {children}
    </div>
  );
}

export default PageContainer;
