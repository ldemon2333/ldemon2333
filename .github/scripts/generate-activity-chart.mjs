import { writeFile, mkdir } from 'node:fs/promises';

const username = process.env.GITHUB_REPOSITORY_OWNER || 'ldemon2333';
const token = process.env.GITHUB_TOKEN;

if (!token) throw new Error('GITHUB_TOKEN is required');

const query = `
  query ($login: String!) {
    user(login: $login) {
      contributionsCollection {
        totalCommitContributions
        totalIssueContributions
        totalPullRequestContributions
        totalPullRequestReviewContributions
      }
    }
  }
`;

const response = await fetch('https://api.github.com/graphql', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'User-Agent': `${username}-profile-readme`
  },
  body: JSON.stringify({ query, variables: { login: username } })
});

if (!response.ok) throw new Error(`GitHub API returned ${response.status}`);
const payload = await response.json();
if (payload.errors) throw new Error(payload.errors.map(error => error.message).join(', '));

const data = payload.data.user.contributionsCollection;
const metrics = [
  { label: 'Code reviews', value: data.totalPullRequestReviewContributions, axis: 'top' },
  { label: 'Issues', value: data.totalIssueContributions, axis: 'right' },
  { label: 'Pull requests', value: data.totalPullRequestContributions, axis: 'bottom' },
  { label: 'Commits', value: data.totalCommitContributions, axis: 'left' }
];
const total = metrics.reduce((sum, metric) => sum + metric.value, 0);
const percentages = metrics.map(metric => total ? Math.round(metric.value / total * 100) : 0);

const center = { x: 360, y: 215 };
const radius = 128;
const minimumRadius = 8;
const points = [
  [center.x, center.y - Math.max(minimumRadius, radius * percentages[0] / 100)],
  [center.x + Math.max(minimumRadius, radius * percentages[1] / 100), center.y],
  [center.x, center.y + Math.max(minimumRadius, radius * percentages[2] / 100)],
  [center.x - Math.max(minimumRadius, radius * percentages[3] / 100), center.y]
];

const labels = [
  { x: 360, y: 35, anchor: 'middle', percent: percentages[0], label: metrics[0].label },
  { x: 535, y: 207, anchor: 'start', percent: percentages[1], label: metrics[1].label },
  { x: 360, y: 392, anchor: 'middle', percent: percentages[2], label: metrics[2].label },
  { x: 185, y: 207, anchor: 'end', percent: percentages[3], label: metrics[3].label }
];

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="430" viewBox="0 0 720 430" role="img" aria-labelledby="title desc">
  <title id="title">${username}'s GitHub activity overview</title>
  <desc id="desc">Distribution of commits, pull requests, issues, and code reviews over the last year.</desc>
  <style>
    .panel { fill: #ffffff; stroke: #d0d7de; }
    .axis { stroke: #1a7f37; stroke-width: 3; stroke-linecap: round; }
    .shape { fill: #57d68d; fill-opacity: .55; stroke: #2da44e; stroke-width: 2; }
    .point { fill: #ffffff; stroke: #1a7f37; stroke-width: 3; }
    .percent { fill: #57606a; font: 17px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .label { fill: #57606a; font: 16px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    @media (prefers-color-scheme: dark) {
      .panel { fill: #0d1117; stroke: #30363d; }
      .percent, .label { fill: #8b949e; }
      .axis { stroke: #3fb950; }
      .shape { fill: #2ea043; stroke: #3fb950; }
      .point { fill: #0d1117; stroke: #3fb950; }
    }
  </style>
  <rect class="panel" x="1" y="1" width="718" height="428" rx="12"/>
  <line class="axis" x1="360" y1="68" x2="360" y2="362"/>
  <line class="axis" x1="213" y1="215" x2="507" y2="215"/>
  <polygon class="shape" points="${points.map(point => point.join(',')).join(' ')}"/>
  ${points.map(point => `<circle class="point" cx="${point[0]}" cy="${point[1]}" r="5"/>`).join('\n  ')}
  ${labels.map(item => `<text class="percent" x="${item.x}" y="${item.y}" text-anchor="${item.anchor}">${item.percent}%</text>
  <text class="label" x="${item.x}" y="${item.y + 22}" text-anchor="${item.anchor}">${item.label}</text>`).join('\n  ')}
</svg>`;

await mkdir('assets', { recursive: true });
await writeFile('assets/activity-overview.svg', svg);
console.log(`Generated activity chart for ${username}:`, Object.fromEntries(metrics.map((metric, index) => [metric.label, percentages[index]])));
