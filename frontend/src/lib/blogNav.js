const BLOG_HREF = '/blog';

function normalizeHref(href) {
  return String(href || '').replace(/\/$/, '') || '/';
}

function isBlogNavItem(item) {
  return normalizeHref(item?.href) === BLOG_HREF;
}

/** Show or hide Blog in header/footer menus based on Admin → Page Headers → Blog toggle. */
export function applyBlogNavItems(items, blogVisible) {
  const list = (items || []).map((item) => ({ ...item }));
  const idx = list.findIndex(isBlogNavItem);

  if (blogVisible) {
    if (idx === -1) {
      const afterIdx = list.findIndex((item) =>
        ['/transformations', '/case-studies'].includes(normalizeHref(item.href)),
      );
      const blogItem = { label: 'Blog', href: BLOG_HREF, position: 'left', visible: true };
      if (afterIdx >= 0) list.splice(afterIdx + 1, 0, blogItem);
      else list.push(blogItem);
    } else {
      list[idx] = { ...list[idx], visible: true, href: BLOG_HREF, label: list[idx].label || 'Blog' };
    }
    return list;
  }

  if (idx >= 0) {
    list[idx] = { ...list[idx], visible: false };
  }
  return list;
}

export function blogNavEnabled(settings) {
  return settings?.blog_page_visible === true;
}
