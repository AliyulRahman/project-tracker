Use AI_Dev
Go


-- =============================================================
-- DevTracker - SQL Server Table Creation Script
-- =============================================================

-- -------------------------------------------------------------
-- 1. dbo.ProjectTracker_Developers
--    Sourced from config.json > developers[]
-- -------------------------------------------------------------
CREATE TABLE dbo.ProjectTracker_Developers (
    DeveloperId   INT           IDENTITY(1,1) PRIMARY KEY,
    Name          NVARCHAR(255) NOT NULL,
    IsActive      BIT           NOT NULL DEFAULT 1,
    CreatedAt     DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);


-- -------------------------------------------------------------
-- 2. dbo.ProjectTracker_JiraItems
--    Sourced from jira-items.json
-- -------------------------------------------------------------
CREATE TABLE dbo.ProjectTracker_JiraItems (
    JiraItemId    UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
    JiraId        NVARCHAR(50)     NOT NULL,           -- e.g. "SAL-18"
    Title         NVARCHAR(500)    NOT NULL,
    Url           NVARCHAR(2048)   NULL,
    IsActive      BIT              NOT NULL DEFAULT 1,
    CreatedAt     DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt     DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE UNIQUE INDEX UX_ProjectTracker_JiraItems_JiraId ON dbo.ProjectTracker_JiraItems (JiraId);


-- -------------------------------------------------------------
-- 3. dbo.ProjectTracker_Entries
--    Sourced from entries.json
--    References dbo.ProjectTracker_JiraItems and dbo.ProjectTracker_Developers
-- -------------------------------------------------------------
CREATE TABLE dbo.ProjectTracker_Entries (
    EntryId          UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
    JiraItemId       UNIQUEIDENTIFIER NOT NULL,
    DeveloperId      INT              NOT NULL,
    EntryDate        DATE             NOT NULL,
    ActivityDetails  NVARCHAR(MAX)    NULL,
    Completion       TINYINT          NOT NULL DEFAULT 0,  -- 0-100
    AiUsage          TINYINT          NOT NULL DEFAULT 0,  -- 0-100
    AiDescription    NVARCHAR(MAX)    NULL,
    CreatedAt        DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),

    CONSTRAINT FK_ProjectTracker_Entries_JiraItems
        FOREIGN KEY (JiraItemId) REFERENCES dbo.ProjectTracker_JiraItems (JiraItemId),

    CONSTRAINT FK_ProjectTracker_Entries_Developers
        FOREIGN KEY (DeveloperId) REFERENCES dbo.ProjectTracker_Developers (DeveloperId),

    CONSTRAINT CK_ProjectTracker_Entries_Completion
        CHECK (Completion BETWEEN 0 AND 100),

    CONSTRAINT CK_ProjectTracker_Entries_AiUsage
        CHECK (AiUsage BETWEEN 0 AND 100)
);

CREATE INDEX IX_ProjectTracker_Entries_JiraItemId  ON dbo.ProjectTracker_Entries (JiraItemId);
CREATE INDEX IX_ProjectTracker_Entries_DeveloperId ON dbo.ProjectTracker_Entries (DeveloperId);
CREATE INDEX IX_ProjectTracker_Entries_EntryDate   ON dbo.ProjectTracker_Entries (EntryDate);


-- =============================================================
-- INSERT: Developers (from config.json)
-- =============================================================
INSERT INTO dbo.ProjectTracker_Developers (Name)
VALUES
    ('Developer 1'),
    ('Developer 2'),
    ('Developer 3'),
    ('Developer 4');


-- =============================================================
-- INSERT: JiraItems (from jira-items.json)
-- =============================================================
INSERT INTO dbo.ProjectTracker_JiraItems (JiraItemId, JiraId, Title, Url, IsActive, CreatedAt, UpdatedAt)
VALUES
    (
        'da16c2e0-258d-4783-94d9-9c637628d058',
        'SAL-18',
        'SAL-18, IPW- Last meeting date - BE logic and Account layout/page changes',
        NULL,
        1,
        CAST('2026-05-08T19:33:55.742Z' AS DATETIME2),
        CAST('2026-05-09T12:21:00.129Z' AS DATETIME2)
    );


-- =============================================================
-- INSERT: Entries (from entries.json)
-- Developer name is resolved to DeveloperId via JOIN
-- =============================================================
INSERT INTO dbo.ProjectTracker_Entries
    (EntryId, JiraItemId, DeveloperId, EntryDate, ActivityDetails, Completion, AiUsage, AiDescription, CreatedAt)
SELECT
    e.EntryId,
    e.JiraItemId,
    d.DeveloperId,
    e.EntryDate,
    e.ActivityDetails,
    e.Completion,
    e.AiUsage,
    e.AiDescription,
    e.CreatedAt
FROM (
    VALUES
        (
            CAST('7c1c675e-cd83-4c44-89a6-9cbd79eaf824' AS UNIQUEIDENTIFIER),
            CAST('da16c2e0-258d-4783-94d9-9c637628d058' AS UNIQUEIDENTIFIER),
            'Developer 1',
            CAST('2026-05-08' AS DATE),
            N'hghg',
            CAST(32 AS TINYINT), CAST(20 AS TINYINT), N'ghgg',
            CAST('2026-05-08T19:34:21.963Z' AS DATETIME2)
        ),
        (
            CAST('c4aaea53-8511-4c2b-91e2-5f8a923071bc' AS UNIQUEIDENTIFIER),
            CAST('da16c2e0-258d-4783-94d9-9c637628d058' AS UNIQUEIDENTIFIER),
            'Developer 1',
            CAST('2026-05-08' AS DATE),
            N'fdg',
            CAST(2 AS TINYINT), CAST(0 AS TINYINT), N'sfdg',
            CAST('2026-05-08T19:41:54.387Z' AS DATETIME2)
        ),
        (
            CAST('07108ae0-1793-4892-b0dd-720856a2d20f' AS UNIQUEIDENTIFIER),
            CAST('da16c2e0-258d-4783-94d9-9c637628d058' AS UNIQUEIDENTIFIER),
            'Developer 2',
            CAST('2026-05-08' AS DATE),
            N'gfd',
            CAST(0 AS TINYINT), CAST(0 AS TINYINT), N'fdg',
            CAST('2026-05-08T19:41:54.396Z' AS DATETIME2)
        )
) AS e (EntryId, JiraItemId, DeveloperName, EntryDate, ActivityDetails, Completion, AiUsage, AiDescription, CreatedAt)
JOIN dbo.ProjectTracker_Developers d ON d.Name = e.DeveloperName;

-- Add Password and Role columns to Developers table
ALTER TABLE dbo.ProjectTracker_Developers
  ADD [Password] NVARCHAR(255) NULL,
      [Role]     NVARCHAR(50)  NOT NULL DEFAULT 'developer';

-- Set a default password for existing rows (change as needed)
UPDATE dbo.ProjectTracker_Developers
SET [Password] = NULL
WHERE [Password] IS NULL;

-- Optional: add a check constraint to limit role values
ALTER TABLE dbo.ProjectTracker_Developers
  ADD CONSTRAINT CK_Developers_Role
    CHECK ([Role] IN ('admin', 'developer', 'viewer'));
