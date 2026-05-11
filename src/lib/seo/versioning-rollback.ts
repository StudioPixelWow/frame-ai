// מערכת גרסאות וביטול — Versioning & Rollback System
// שומרת snapshot של כל דף לפני שינוי, מאפשרת חזרה לגרסה קודמת

import { WPConnection, updatePageContent, updateYoastMeta } from './wordpress-client';

// ============================================================================
// ממשקים — Interfaces
// ============================================================================

export interface ContentVersion {
  id: string;
  pageId: number;
  pageUrl: string;
  pageTitle: string;
  timestamp: string;
  content: string;
  metadata: { title: string; description: string; focusKeyword: string };
  schemaData: string;
  actionId?: string;        // איזו פעולה גרמה לגרסה הזו
  module?: string;          // איזה מנוע ביצע את השינוי
}

export interface VersioningResult {
  versionsCreated: number;
  rollbacksPerformed: number;
  storageUsed: number;
}

export interface VersionDiff {
  contentDiff: string;
  metadataChanges: string[];
}

// ============================================================================
// שירות גרסאות — Versioning Service
// ============================================================================

/**
 * מחסן גרסאות בזיכרון — Map<pageId, ContentVersion[]>
 * כל דף שומר את כל הגרסאות שלו ממוינות לפי זמן
 */
interface VersioningService {
  /** שומר snapshot של דף לפני שינוי */
  createVersion: (
    pageId: number,
    pageUrl: string,
    pageTitle: string,
    content: string,
    metadata: { title: string; description: string; focusKeyword: string },
    schemaData: string,
    actionId?: string,
    module?: string
  ) => ContentVersion;

  /** מחזיר את כל הגרסאות של דף — ממוינות מהחדשה לישנה */
  getVersions: (pageId: number) => ContentVersion[];

  /** מחזיר דף לגרסה ספציפית */
  rollbackToVersion: (versionId: string, connection: WPConnection) => Promise<boolean>;

  /** משווה בין שתי גרסאות */
  compareVersions: (v1: ContentVersion, v2: ContentVersion) => VersionDiff;

  /** ייצוא ל-JSON לשמירה */
  toJSON: () => string;

  /** ייבוא מ-JSON */
  fromJSON: (json: string) => void;

  /** סטטיסטיקות */
  getStats: () => VersioningResult;
}

// ============================================================================
// יצירת שירות גרסאות — Create Versioning Service
// ============================================================================

/**
 * יוצר מופע חדש של שירות גרסאות
 * המידע נשמר בזיכרון — משתמש ב-toJSON/fromJSON לשמירה חיצונית
 */
export function createVersioningService(): VersioningService {
  // מחסן גרסאות בזיכרון
  const store = new Map<number, ContentVersion[]>();
  let rollbackCount = 0;

  // --- createVersion ---
  function createVersion(
    pageId: number,
    pageUrl: string,
    pageTitle: string,
    content: string,
    metadata: { title: string; description: string; focusKeyword: string },
    schemaData: string,
    actionId?: string,
    module?: string
  ): ContentVersion {
    const version: ContentVersion = {
      id: `v-${pageId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      pageId,
      pageUrl,
      pageTitle,
      timestamp: new Date().toISOString(),
      content,
      metadata: { ...metadata },
      schemaData,
      actionId,
      module,
    };

    const existing = store.get(pageId) || [];
    existing.unshift(version); // החדש ראשון
    store.set(pageId, existing);

    return version;
  }

  // --- getVersions ---
  function getVersions(pageId: number): ContentVersion[] {
    return store.get(pageId) || [];
  }

  // --- rollbackToVersion ---
  async function rollbackToVersion(versionId: string, connection: WPConnection): Promise<boolean> {
    // חפש את הגרסה בכל הדפים
    let targetVersion: ContentVersion | null = null;

    for (const [, versions] of store) {
      const found = versions.find(v => v.id === versionId);
      if (found) {
        targetVersion = found;
        break;
      }
    }

    if (!targetVersion) {
      console.error(`גרסה ${versionId} לא נמצאה`);
      return false;
    }

    try {
      // שחזור תוכן הדף
      const contentResult = await updatePageContent(
        connection,
        targetVersion.pageId,
        targetVersion.content
      );

      if (!contentResult.success) {
        console.error(`שגיאה בשחזור תוכן דף ${targetVersion.pageId}: ${contentResult.error}`);
        return false;
      }

      // שחזור מטא-דאטה של Yoast
      if (targetVersion.metadata.title || targetVersion.metadata.description) {
        const metaResult = await updateYoastMeta(
          connection,
          targetVersion.pageId,
          {
            title: targetVersion.metadata.title,
            description: targetVersion.metadata.description,
            focusKeyword: targetVersion.metadata.focusKeyword,
            canonical: '', // לא משחזרים canonical — יחושב מחדש
          }
        );

        if (!metaResult.success) {
          console.error(`שגיאה בשחזור מטא דף ${targetVersion.pageId}: ${metaResult.error}`);
          // ממשיכים — התוכן עצמו שוחזר
        }
      }

      rollbackCount++;
      return true;
    } catch (error) {
      console.error(`שגיאה בשחזור גרסה ${versionId}:`, error);
      return false;
    }
  }

  // --- compareVersions ---
  function compareVersions(v1: ContentVersion, v2: ContentVersion): VersionDiff {
    const metadataChanges: string[] = [];

    // השוואת מטא-דאטה
    if (v1.metadata.title !== v2.metadata.title) {
      metadataChanges.push(`כותרת: "${v1.metadata.title}" → "${v2.metadata.title}"`);
    }
    if (v1.metadata.description !== v2.metadata.description) {
      metadataChanges.push(`תיאור: "${v1.metadata.description.slice(0, 60)}..." → "${v2.metadata.description.slice(0, 60)}..."`);
    }
    if (v1.metadata.focusKeyword !== v2.metadata.focusKeyword) {
      metadataChanges.push(`מילת מפתח: "${v1.metadata.focusKeyword}" → "${v2.metadata.focusKeyword}"`);
    }
    if (v1.schemaData !== v2.schemaData) {
      metadataChanges.push('סכמה: שונתה');
    }

    // השוואת תוכן — פשוטה: אורך ושינוי
    const contentDiff = buildSimpleContentDiff(v1.content, v2.content);

    return { contentDiff, metadataChanges };
  }

  // --- toJSON ---
  function toJSON(): string {
    const data: Record<string, ContentVersion[]> = {};
    for (const [pageId, versions] of store) {
      data[String(pageId)] = versions;
    }
    return JSON.stringify({ versions: data, rollbackCount });
  }

  // --- fromJSON ---
  function fromJSON(json: string): void {
    try {
      const parsed = JSON.parse(json);
      store.clear();

      if (parsed.versions) {
        for (const [pageIdStr, versions] of Object.entries(parsed.versions)) {
          const pageId = parseInt(pageIdStr, 10);
          if (!isNaN(pageId) && Array.isArray(versions)) {
            store.set(pageId, versions as ContentVersion[]);
          }
        }
      }

      if (typeof parsed.rollbackCount === 'number') {
        rollbackCount = parsed.rollbackCount;
      }
    } catch (error) {
      console.error('שגיאה בטעינת נתוני גרסאות:', error);
    }
  }

  // --- getStats ---
  function getStats(): VersioningResult {
    let versionsCreated = 0;
    let storageUsed = 0;

    for (const [, versions] of store) {
      versionsCreated += versions.length;
      for (const v of versions) {
        // הערכת גודל אחסון — תוכן + מטא + סכמה
        storageUsed += (v.content?.length || 0) + (v.schemaData?.length || 0) + 200;
      }
    }

    return {
      versionsCreated,
      rollbacksPerformed: rollbackCount,
      storageUsed,
    };
  }

  return {
    createVersion,
    getVersions,
    rollbackToVersion,
    compareVersions,
    toJSON,
    fromJSON,
    getStats,
  };
}

// ============================================================================
// פונקציות עזר — Helper Functions
// ============================================================================

/**
 * בונה השוואת תוכן פשוטה — אורך, מילים שנוספו/הוסרו
 */
function buildSimpleContentDiff(content1: string, content2: string): string {
  if (content1 === content2) return 'ללא שינוי בתוכן';

  const words1 = content1.split(/\s+/).length;
  const words2 = content2.split(/\s+/).length;
  const wordDiff = words2 - words1;

  const chars1 = content1.length;
  const chars2 = content2.length;
  const charDiff = chars2 - chars1;

  const parts: string[] = [];

  if (wordDiff > 0) {
    parts.push(`נוספו ~${wordDiff} מילים`);
  } else if (wordDiff < 0) {
    parts.push(`הוסרו ~${Math.abs(wordDiff)} מילים`);
  }

  if (charDiff > 0) {
    parts.push(`נוספו ${charDiff} תווים`);
  } else if (charDiff < 0) {
    parts.push(`הוסרו ${Math.abs(charDiff)} תווים`);
  }

  // בדיקת שורות חדשות
  const lines1 = content1.split('\n').length;
  const lines2 = content2.split('\n').length;
  const lineDiff = lines2 - lines1;
  if (lineDiff !== 0) {
    parts.push(`${lineDiff > 0 ? 'נוספו' : 'הוסרו'} ${Math.abs(lineDiff)} שורות`);
  }

  return parts.length > 0 ? parts.join(', ') : 'שינוי מינורי בתוכן';
}

// ============================================================================
// פונקציות נוחות — Convenience Exports
// ============================================================================

/**
 * יוצר גרסה — wrapper ישיר לשימוש מהיר
 */
export function createVersion(
  pageId: number,
  pageUrl: string,
  pageTitle: string,
  content: string,
  metadata: { title: string; description: string; focusKeyword: string },
  schemaData: string,
  actionId?: string,
  module?: string
): ContentVersion {
  return {
    id: `v-${pageId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    pageId,
    pageUrl,
    pageTitle,
    timestamp: new Date().toISOString(),
    content,
    metadata: { ...metadata },
    schemaData,
    actionId,
    module,
  };
}

/**
 * משווה שתי גרסאות — wrapper ישיר
 */
export function compareVersions(v1: ContentVersion, v2: ContentVersion): VersionDiff {
  const service = createVersioningService();
  return service.compareVersions(v1, v2);
}
