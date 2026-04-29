pipeline {
    agent any

    environment {
        GITLAB_CREDENTIALS = 'gitlab-credentials'
        DEPLOY_PATH        = '/home/ubuntu/app'
        REPO_URL           = 'https://lab.ssafy.com/s14-final/S14P31S107.git'
    }

    stages {

        // 1단계: GitLab에서 코드 가져오기
        stage('Clone') {
            steps {
                git branch: 'develop',
                    credentialsId: "${GITLAB_CREDENTIALS}",
                    url: "${REPO_URL}"
            }
        }

        // 2단계: 환경변수 파일 준비 (빌드 전 .env.prod 복사)
        stage('Prepare') {
                steps {
                    sh """
                        cp /home/ubuntu/app/.env.prod ./.env.prod
                        cp /home/ubuntu/app/BE/.env.prod ./BE/.env.prod
                        cp /home/ubuntu/app/FE/.env.prod ./FE/.env.prod
                    """
                }
        }

        // 3단계: Docker 이미지 빌드
        stage('Build') {
            steps {
                sh 'docker compose -f docker-compose.prod.yml build --no-cache fe'
                sh 'docker compose -f docker-compose.prod.yml build be'
            }
        }

        // 4단계: 서버에 배포
        stage('Deploy') {
            steps {
                sh """
                    cp /home/ubuntu/app/.env.prod ./.env.prod
                    cp /home/ubuntu/app/BE/.env.prod ./BE/.env.prod
                    cp /home/ubuntu/app/FE/.env.prod ./FE/.env.prod

                    docker compose -f docker-compose.prod.yml down
                    docker compose -f docker-compose.prod.yml up -d
                """
            }
        }

    }

    post {
        success {
            echo '배포 성공! ✅'
        }
        failure {
            echo '배포 실패! ❌'
        }
    }
}