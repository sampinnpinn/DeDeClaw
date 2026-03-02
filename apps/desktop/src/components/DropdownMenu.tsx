import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronRight } from 'lucide-react';

export interface MenuItem {
  id: string;
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  danger?: boolean;
  children?: MenuItem[];
  checked?: boolean;
  disabled?: boolean;
}

interface DropdownMenuProps {
  items: MenuItem[];
  isOpen: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLElement | null>;
  align?: 'left' | 'right';
  position?: 'top' | 'bottom' | 'left-side' | 'right-side';
}

function DropdownMenu({ items, isOpen, onClose, triggerRef, align = 'left', position = 'bottom' }: DropdownMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const closeTimerRef = useRef<number | null>(null);
  const [activeSubmenuId, setActiveSubmenuId] = useState<string | null>(null);
  const [resolvedPosition, setResolvedPosition] = useState<DropdownMenuProps['position']>(position);
  const [submenuSideById, setSubmenuSideById] = useState<Record<string, 'left' | 'right'>>({});
  const [submenuVerticalById, setSubmenuVerticalById] = useState<Record<string, 'top' | 'bottom'>>({});

  const SUBMENU_MIN_WIDTH = 180;
  const SUBMENU_CLOSE_DELAY = 160;

  const cancelScheduledClose = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const scheduleCloseSubmenu = () => {
    cancelScheduledClose();

    closeTimerRef.current = window.setTimeout(() => {
      setActiveSubmenuId(null);
      closeTimerRef.current = null;
    }, SUBMENU_CLOSE_DELAY);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, triggerRef]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setActiveSubmenuId(null);
      setSubmenuSideById({});
      setSubmenuVerticalById({});
    }
  }, [isOpen]);

  useEffect(() => {
    setResolvedPosition(position);
  }, [position]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const updateResolvedPosition = () => {
      if (!triggerRef.current || !menuRef.current) {
        return;
      }

      if (position !== 'bottom' && position !== 'top') {
        setResolvedPosition(position);
        return;
      }

      const triggerRect = triggerRef.current.getBoundingClientRect();
      const menuRect = menuRef.current.getBoundingClientRect();
      const spaceAbove = triggerRect.top;
      const spaceBelow = window.innerHeight - triggerRect.bottom;
      const menuHeight = menuRect.height + 12;

      if (position === 'bottom' && spaceBelow < menuHeight && spaceAbove > spaceBelow) {
        setResolvedPosition('top');
        return;
      }

      if (position === 'top' && spaceAbove < menuHeight && spaceBelow > spaceAbove) {
        setResolvedPosition('bottom');
        return;
      }

      setResolvedPosition(position);
    };

    const frameId = window.requestAnimationFrame(updateResolvedPosition);
    window.addEventListener('resize', updateResolvedPosition);
    window.addEventListener('scroll', updateResolvedPosition, true);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', updateResolvedPosition);
      window.removeEventListener('scroll', updateResolvedPosition, true);
    };
  }, [align, isOpen, items, position, triggerRef]);

  if (!isOpen) return null;

  const getPositionClasses = () => {
    switch (resolvedPosition) {
      case 'top':
        return `bottom-full mb-2 ${align === 'right' ? 'right-0' : 'left-0'}`;
      case 'left-side':
        return 'right-full mr-2 top-0';
      case 'right-side':
        return 'left-full ml-2 top-0';
      case 'bottom':
      default:
        return `top-full mt-2 ${align === 'right' ? 'right-0' : 'left-0'}`;
    }
  };

  const getSubmenuSide = (itemId: string): 'left' | 'right' => {
    const button = itemRefs.current[itemId];

    if (!button) {
      return 'right';
    }

    const rect = button.getBoundingClientRect();
    const rightAvailable = window.innerWidth - rect.right;

    if (rightAvailable < SUBMENU_MIN_WIDTH + 12) {
      return 'left';
    }

    return 'right';
  };

  const getSubmenuVertical = (itemId: string, childCount: number): 'top' | 'bottom' => {
    const button = itemRefs.current[itemId];

    if (!button) {
      return 'top';
    }

    const rect = button.getBoundingClientRect();
    const estimatedSubmenuHeight = childCount * 40 + 16;
    const spaceBelowFromTop = window.innerHeight - rect.top;
    const spaceAboveFromBottom = rect.bottom;

    if (spaceBelowFromTop < estimatedSubmenuHeight && spaceAboveFromBottom > spaceBelowFromTop) {
      return 'bottom';
    }

    return 'top';
  };

  const openSubmenu = (itemId: string) => {
    cancelScheduledClose();

    const side = getSubmenuSide(itemId);
    const targetItem = items.find((item) => item.id === itemId);
    const vertical = getSubmenuVertical(itemId, targetItem?.children?.length ?? 0);

    setSubmenuSideById((prev) => ({
      ...prev,
      [itemId]: side,
    }));
    setSubmenuVerticalById((prev) => ({
      ...prev,
      [itemId]: vertical,
    }));
    setActiveSubmenuId(itemId);
  };

  const closeSubmenu = () => {
    cancelScheduledClose();
    setActiveSubmenuId(null);
  };

  return (
    <div
      ref={menuRef}
      className={`absolute bg-white rounded-xl shadow-lg border border-gray-100 py-2 min-w-[180px] z-50 ${getPositionClasses()}`}
    >
      {items.map((item) => {
        const hasChildren = Boolean(item.children && item.children.length > 0);
        const isSubmenuOpen = activeSubmenuId === item.id;
        const submenuSide = submenuSideById[item.id] ?? 'right';
        const submenuVertical = submenuVerticalById[item.id] ?? 'top';
        const isDisabled = item.disabled === true;

        return (
          <div
            key={item.id}
            className="relative"
            onMouseEnter={() => {
              if (hasChildren) {
                cancelScheduledClose();
              }
            }}
            onMouseLeave={() => {
              if (hasChildren) {
                scheduleCloseSubmenu();
              }
            }}
          >
            <button
              ref={(el) => {
                itemRefs.current[item.id] = el;
              }}
              onMouseEnter={() => {
                if (hasChildren) {
                  openSubmenu(item.id);
                } else {
                  closeSubmenu();
                }
              }}
              onClick={() => {
                if (isDisabled) {
                  return;
                }

                if (hasChildren) {
                  if (isSubmenuOpen) {
                    closeSubmenu();
                  } else {
                    openSubmenu(item.id);
                  }
                  return;
                }

                item.onClick();
                onClose();
              }}
              disabled={isDisabled}
              className={`w-full px-4 py-2.5 text-left text-sm flex items-center justify-between gap-3 transition-colors ${
                isDisabled
                  ? 'text-gray-300 cursor-not-allowed'
                  : item.danger
                  ? 'text-red-600 hover:bg-red-50'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span className="flex items-center gap-3 min-w-0">
                {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
                <span className="truncate">{item.label}</span>
              </span>
              {hasChildren && <ChevronRight size={14} className="text-gray-400 flex-shrink-0" />}
            </button>

            {hasChildren && isSubmenuOpen && (
              <div
                onMouseEnter={cancelScheduledClose}
                onMouseLeave={scheduleCloseSubmenu}
                className={`absolute bg-white rounded-xl shadow-lg border border-gray-100 py-2 min-w-[180px] z-[60] ${submenuVertical === 'top' ? 'top-0' : 'bottom-0'
                  } ${submenuSide === 'right' ? 'left-full ml-2' : 'right-full mr-2'
                  }`}
              >
                <div
                  className={`absolute top-0 h-full w-2 bg-transparent ${submenuSide === 'right' ? '-left-2' : '-right-2'
                    }`}
                />
                {item.children?.map((subItem) => {
                  const isSubDisabled = subItem.disabled === true;
                  return (
                    <button
                      key={subItem.id}
                      onClick={() => {
                        if (isSubDisabled) {
                          return;
                        }
                        subItem.onClick();
                        onClose();
                      }}
                      disabled={isSubDisabled}
                      className={`w-full px-4 py-2.5 text-left text-sm flex items-center justify-between gap-3 transition-colors ${
                        isSubDisabled
                          ? 'text-gray-300 cursor-not-allowed'
                          : subItem.danger
                          ? 'text-red-600 hover:bg-red-50'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <span className="flex items-center gap-3 min-w-0">
                        {subItem.icon && <span className="flex-shrink-0">{subItem.icon}</span>}
                        <span className="truncate">{subItem.label}</span>
                      </span>
                      {subItem.checked && <Check size={14} className="text-[#7678ee] flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default DropdownMenu;
