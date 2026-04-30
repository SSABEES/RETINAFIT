from sqlalchemy import create_engine, text
from app.core.config import settings

# 비동기 드라이버(aiomysql) → 동기 드라이버(pymysql)로 교체
DATABASE_URL = settings.DATABASE_URL.replace("+aiomysql", "+pymysql")
engine = create_engine(DATABASE_URL)

if __name__ == "__main__":
    sql_file = open("app/sql/init.sql", encoding="utf-8").read()

    statements = [s.strip() for s in sql_file.split(";") if s.strip()]

    with engine.connect() as conn:
        for statement in statements:
            conn.execute(text(statement))
        conn.commit()

    print("DB 초기화 완료!")