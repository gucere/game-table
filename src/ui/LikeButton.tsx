import { useProfiles } from '../profile/profile';
import { getStats, isLiked, toggleLike, useStats } from '../profile/stats';
import { accountState, getFirebase } from '../account/account';
import { setSharedLike } from '../account/likes';
import { statsOwner } from '../profile/profile';
import { useT } from '../i18n';

/** Stats (and likes) of whoever is playing on this device right now */
export function useMyStats() {
  const { current } = useProfiles();
  return useStats(current ?? 'guest');
}

export function LikeButton({ id, name, big }: { id: string; name: string; big?: boolean }) {
  const t = useT();
  const liked = isLiked(useMyStats(), id);
  return (
    <button
      type="button"
      className={'like-btn' + (liked ? ' on' : '') + (big ? ' big' : '')}
      aria-pressed={liked}
      aria-label={liked ? t('Unlike {name}', { name }) : t('Like {name}', { name })}
      title={liked ? t('Liked') : t('Like')}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleLike(id);
        // Signed in (and playing as that account): the shared count follows
        const acct = accountState();
        if (acct.status === 'signed-in' && acct.uid && statsOwner() === 'acct_' + acct.uid) {
          const uid = acct.uid;
          void getFirebase()
            .then((f) => setSharedLike(f, uid, id, isLiked(getStats(), id)))
            .catch((e) => console.warn('Like count failed', e));
        }
      }}
    >
      {liked ? '♥' : '♡'}
    </button>
  );
}
