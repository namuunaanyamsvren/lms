import { AppError } from '@lms/shared';

type GitHubRepo = { owner: string; repo: string };

function parseGitHubRepo(repoUrl: string): GitHubRepo {
  let url: URL;
  try {
    url = new URL(repoUrl);
  } catch {
    throw AppError.badRequest('repoUrl must be a valid GitHub repository URL');
  }
  if (url.hostname !== 'github.com' && url.hostname !== 'www.github.com') {
    throw AppError.badRequest('Only GitHub repository URLs are supported');
  }
  const [owner, repo] = url.pathname.replace(/^\/+/, '').split('/');
  if (!owner || !repo) throw AppError.badRequest('repoUrl must include owner and repository');
  return { owner, repo: repo.replace(/\.git$/i, '') };
}

async function githubJson(path: string) {
  const headers: Record<string, string> = {
    accept: 'application/vnd.github+json',
    'user-agent': 'lms-repo-validator',
  };
  if (process.env.GITHUB_REPO_VALIDATION_TOKEN) {
    headers.authorization = `Bearer ${process.env.GITHUB_REPO_VALIDATION_TOKEN}`;
  }
  const response = await fetch(`https://api.github.com${path}`, { headers });
  if (response.status === 404) return null;
  if (!response.ok) throw AppError.badRequest(`GitHub validation failed with HTTP ${response.status}`);
  return response.json();
}

export async function validateRepositorySubmission(repoUrl?: string | null, commitHash?: string | null) {
  if (!repoUrl) return;
  const repo = parseGitHubRepo(repoUrl);
  const repository = await githubJson(`/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}`);
  if (!repository) throw AppError.badRequest('GitHub repository was not found or is not accessible');
  if (commitHash) {
    const commit = await githubJson(
      `/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}/commits/${encodeURIComponent(commitHash)}`,
    );
    if (!commit) throw AppError.badRequest('commitHash was not found in the GitHub repository');
  }
}
