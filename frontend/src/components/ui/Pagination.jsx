import styles from './Pagination.module.css';

/**
 * Reusable Pagination Component.
 *
 * @param {Object} props
 * @param {number} props.currentPage - Current active page (1-based)
 * @param {number} props.totalItems - Total count of records
 * @param {number} [props.pageSize=10] - Records per page
 * @param {function} props.onPageChange - Handler called when a page is selected
 * @param {boolean} [props.disabled=false] - Optional loading/disabled state
 */
export default function Pagination({
  currentPage = 1,
  totalItems = 0,
  pageSize = 10,
  onPageChange,
  disabled = false,
}) {
  const totalPages = Math.ceil(totalItems / pageSize);

  if (totalPages <= 1) return null;

  const startRecord = (currentPage - 1) * pageSize + 1;
  const endRecord = Math.min(currentPage * pageSize, totalItems);

  // Generate page array with smart ellipsis
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);

      if (currentPage > 3) {
        pages.push('...');
      }

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (currentPage < totalPages - 2) {
        pages.push('...');
      }

      pages.push(totalPages);
    }

    return pages;
  };

  const pages = getPageNumbers();

  return (
    <nav className={styles.paginationWrapper} aria-label="Pagination Navigation">
      <div className={styles.infoText}>
        Showing <strong>{startRecord}</strong>–<strong>{endRecord}</strong> of{' '}
        <strong>{totalItems}</strong> records
      </div>

      <div className={styles.controls}>
        {/* Previous Button */}
        <button
          type="button"
          className={`${styles.pageBtn} ${styles.navBtn}`}
          onClick={() => onPageChange?.(currentPage - 1)}
          disabled={disabled || currentPage <= 1}
          aria-label="Previous Page"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span>Prev</span>
        </button>

        {/* Page Numbers */}
        {pages.map((p, idx) => {
          if (p === '...') {
            return (
              <span key={`ellipsis-${idx}`} className={styles.ellipsis}>
                …
              </span>
            );
          }

          const isActive = p === currentPage;
          return (
            <button
              key={p}
              type="button"
              className={`${styles.pageBtn} ${isActive ? styles.activePage : ''}`}
              onClick={() => onPageChange?.(p)}
              disabled={disabled}
              aria-current={isActive ? 'page' : undefined}
              aria-label={`Page ${p}`}
            >
              {p}
            </button>
          );
        })}

        {/* Next Button */}
        <button
          type="button"
          className={`${styles.pageBtn} ${styles.navBtn}`}
          onClick={() => onPageChange?.(currentPage + 1)}
          disabled={disabled || currentPage >= totalPages}
          aria-label="Next Page"
        >
          <span>Next</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </nav>
  );
}
