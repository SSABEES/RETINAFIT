pipeline {
    agent any

    environment {
        GITLAB_CREDENTIALS = 'gitlab-credentials'
        DEPLOY_PATH        = '/home/ubuntu/app'
        REPO_URL           = 'https://lab.ssafy.com/s14-final/S14P31S107.git'
        WORKSPACE_PATH     = '/var/jenkins_home/workspace/retina-pipeline'
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
                    cp /home/ubuntu/app/BE/.env.prod ./BE/.env.prod
                    cp /home/ubuntu/app/FE/.env.prod ./FE/svelte/.env.prod
                    cp /home/ubuntu/app/AI/.env.prod ./AI/.env.prod
                """
            }
        }

        // 3단계: FE 빌드 및 배포
        stage('Deploy FE') {
            steps {
                sh """
                    cd ${WORKSPACE_PATH}/FE/svelte
                    npm ci
                    npm run build -- --mode prod
                    sudo cp -r ${WORKSPACE_PATH}/FE/svelte/dist/* /var/www/html/
                """
            }
        }

        // 4단계: BE 호스트 재시작
        stage('Deploy BE') {
            steps {
                sh """
                    cd ${WORKSPACE_PATH}/BE
                    export APP_ENV=production
                    /home/ubuntu/.local/bin/uv sync
                    sudo systemctl restart retina-be
                """
            }
        }

        // 5단계: AI 호스트 재시작
        stage('Deploy AI') {
            steps {
                sh """
                    cd ${WORKSPACE_PATH}/AI
                    export APP_ENV=production
                    /home/ubuntu/.local/bin/uv sync
                    sudo systemctl restart retina-ai
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