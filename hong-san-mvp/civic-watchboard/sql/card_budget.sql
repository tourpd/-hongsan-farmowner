-- sql/card_budget.sql
WITH base AS (
  SELECT
    bidNtceDt AS dt,
    bidNtceNm AS title,
    COALESCE(budget, 0) AS budget
  FROM bids
  WHERE bidNtceNo LIKE 'DUMMY%'
),
tagged AS (
  SELECT
    CASE
      WHEN title LIKE '%대곡%' OR title LIKE '%대곡역%' OR title LIKE '%환승%' OR title LIKE '%환승센터%' OR title LIKE '%GTX%' OR title LIKE '%광역교통%' OR title LIKE '%연계%' OR title LIKE '%버스%'
        THEN '정책카드: 대곡역 환승체계(교통/광역교통)'

      WHEN title LIKE '%도로%' OR title LIKE '%교량%' OR title LIKE '%육교%' OR title LIKE '%지하차도%' OR title LIKE '%교통%' OR title LIKE '%신호%'
        THEN '정책카드: 교통·도로/시설안전'

      WHEN title LIKE '%공원%' OR title LIKE '%녹지%' OR title LIKE '%호수공원%' OR title LIKE '%가로수%'
        THEN '정책카드: 공원·녹지'

      WHEN title LIKE '%상수도%' OR title LIKE '%급수%' OR title LIKE '%하수%' OR title LIKE '%관로%' OR title LIKE '%GIS%'
        THEN '정책카드: 상하수도·인프라'

      WHEN title LIKE '%폐기물%' OR title LIKE '%쓰레기%' OR title LIKE '%처리용역%'
        THEN '정책카드: 환경·폐기물'

      WHEN title LIKE '%문화%' OR title LIKE '%축제%' OR title LIKE '%공연%' OR title LIKE '%박람회%' OR title LIKE '%셔틀%'
        THEN '정책카드: 문화·행사'

      ELSE '정책카드: 기타'
    END AS policy,
    budget
  FROM base
)
SELECT
  policy,
  COUNT(*) AS cnt,
  SUM(budget) AS total_budget
FROM tagged
GROUP BY policy
ORDER BY total_budget DESC, cnt DESC, policy;