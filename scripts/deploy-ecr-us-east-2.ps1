Param(
	[string]$RepositoryName = "bot-it",
	[string]$Region = "us-east-2"
)

Write-Host "Building and pushing Docker image to ECR ($Region/$RepositoryName) ..."

$accountId = (aws sts get-caller-identity --query Account --output text)
if (-not $accountId) { throw "AWS CLI no autenticado. Ejecuta 'aws configure' primero." }

aws ecr create-repository --repository-name $RepositoryName --region $Region 2>$null | Out-Null

aws ecr get-login-password --region $Region |
 docker login --username AWS --password-stdin "$accountId.dkr.ecr.$Region.amazonaws.com" | Out-Null

$image = "$RepositoryName:latest"
$remote = "$accountId.dkr.ecr.$Region.amazonaws.com/$RepositoryName:latest"

docker build -t $image .
if ($LASTEXITCODE -ne 0) { throw "Docker build failed" }

docker tag $image $remote
docker push $remote
if ($LASTEXITCODE -ne 0) { throw "Docker push failed" }

Write-Host "Done. Image pushed: $remote"


