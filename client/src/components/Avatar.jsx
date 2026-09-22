import { assetUrl } from '../api';

// A circular avatar that shows the user's uploaded profile picture, falling
// back to their initials. Used everywhere a person is shown (topbar, sidebar,
// members list, settings).
function initials(name) {
  if (!name) return '?';
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

// sizeClasses should be round (e.g. "w-8 h-8"); the initials text scales
// loosely with the token size passed via `textClass`.
export default function Avatar({ url, name, sizeClass = 'w-8 h-8', textClass = 'text-xs', id }) {
  if (url) {
    return (
      <img
        src={assetUrl(url)}
        alt={name || 'Profile'}
        data-testid={id}
        className={`${sizeClass} rounded-full object-cover shrink-0 border border-[rgba(199,196,216,0.4)]`}
      />
    );
  }
  return (
    <div
      data-testid={id}
      className={`${sizeClass} rounded-full bg-[#e2e7ff] flex items-center justify-center shrink-0`}
    >
      <span className={`${textClass} font-semibold text-[#3525cd]`}>{initials(name)}</span>
    </div>
  );
}