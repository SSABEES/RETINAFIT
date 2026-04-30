
CREATE TABLE IF NOT EXISTS visited (
    visit_no    BIGINT          NOT NULL AUTO_INCREMENT COMMENT '방문 고유 ID',
    opt_no      BIGINT          NOT NULL                COMMENT '안경원 번호(외부 API)',
    cust_no     BIGINT          NOT NULL                COMMENT '고객 번호(외부 API)',
    cust_name   VARCHAR(50)     NOT NULL                COMMENT '고객 이름',
    birthday    VARCHAR(10)     NOT NULL                COMMENT '생년월일 (YYYY-MM-DD)',
    phone_no1   VARCHAR(13)     NOT NULL                COMMENT '고객 휴대폰 번호',
    phone_no2   VARCHAR(13)     NULL                    COMMENT '고객 예비 휴대폰 번호',
    sex         TINYINT         NOT NULL                COMMENT '0: 남자 / 1: 여자',
    member_no   BIGINT          NOT NULL                COMMENT '안경사 번호(외부 API)',
    main_file           VARCHAR(500)    NULL            COMMENT '정면사진 URL',
    test_file_arr       JSON            NULL            COMMENT '측정 사진 파일들',
    test_json           JSON            NULL            COMMENT '측정한 내역',
    opt_recommend_json  JSON            NULL            COMMENT '안경사 추천 데이터',
    vp_file_arr         JSON            NULL            COMMENT '가상 피팅 사진들',
    vp_json             JSON            NULL            COMMENT '가상 피팅 데이터',
    real_vp_json        JSON            NULL            COMMENT '실제 착용 측정 데이터',
    report_json         JSON            NULL            COMMENT '최종 리포트 데이터',
    create_dt   DATETIME        NOT NULL DEFAULT NOW()  COMMENT '최초 생성일시',
    test_dt     DATETIME        NULL                    COMMENT '얼굴 측정 완료 일시',
    vp_dt       DATETIME        NULL                    COMMENT '가상 피팅 완료 일시',
    real_vp_dt  DATETIME        NULL                    COMMENT '실제 착용 측정 완료 일시',
    update_dt   DATETIME        NULL                    COMMENT '마지막 수정일시',
    PRIMARY KEY (visit_no)
) COMMENT='방문 통합 테이블';

CREATE TABLE IF NOT EXISTS recommend_option (
    option_no       INT         NOT NULL AUTO_INCREMENT  COMMENT '추천 옵션 ID',
    option_name     VARCHAR(50) NOT NULL                 COMMENT '추천 옵션명 (예: 다초점, 변색, 사무직)',
    option_category VARCHAR(50) NOT NULL                 COMMENT '추천 옵션 카테고리 (예: 렌즈 종류, 코팅, 생활환경)',
    display_order   INT         NOT NULL                 COMMENT '화면 표시 순서 (드래그로 변경 가능)',
    is_active       BOOLEAN     NOT NULL                 COMMENT '비활성화 시 화면 미표시',
    PRIMARY KEY (option_no)
) COMMENT='추천 옵션';

CREATE TABLE IF NOT EXISTS fitting_criteria (
    criteria_no     INT             NOT NULL AUTO_INCREMENT   COMMENT '판단 기준 ID',
    criteria_label  VARCHAR(100)    NOT NULL                  COMMENT '판단 결과 유형 (예: 정상범위, 개별 가공 필요...)',
    range_type      ENUM('BELOW', 'NORMAL', 'ABOVE') NOT NULL COMMENT '기준 범위 유형: 하한값 미만 / 정상 / 상한값 초과',
    lower_bound     INT             NULL                      COMMENT '판단 기준 하한선 (단위: mm)',
    upper_bound     INT             NULL                      COMMENT '판단 기준 상한선 (단위: mm)',
    out_of_range_note VARCHAR(500)  NULL                      COMMENT 'BELOW/ABOVE인 경우 설명 (예: 속눈썹 닿음 위험)',
    is_active       BOOLEAN         NOT NULL                  COMMENT '해당 항목으로 판단할건지 여부',
    PRIMARY KEY (criteria_no)
) COMMENT='피팅 기준';

CREATE TABLE IF NOT EXISTS glasses (
    glasses_no      BIGINT          NOT NULL AUTO_INCREMENT   COMMENT '안경 고유 ID',
    glasses_name    VARCHAR(100)    NOT NULL                  COMMENT '안경 제품명',
    glasses_brand   VARCHAR(50)     NOT NULL                  COMMENT '안경 브랜드명',
    glasses_img_url VARCHAR(500)    NOT NULL                  COMMENT '안경 대표 이미지',
    glasses_3d_url  VARCHAR(500)    NULL                      COMMENT '안경 3D 이미지 S3 URL',
    glasses_spec_json JSON          NOT NULL                  COMMENT '안경 스펙 정보',
    is_active       BOOLEAN         NOT NULL                  COMMENT '비활성화시 추천에서 제외',
    created_at      DATETIME        NOT NULL DEFAULT NOW()    COMMENT '등록 일시',
    PRIMARY KEY (glasses_no)
) COMMENT='안경';