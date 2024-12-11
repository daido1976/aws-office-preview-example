```sh
$ docker compose up -d
$ curl -X POST "http://localhost:9002/2015-03-31/functions/function/invocations" \
-H "Content-Type: application/json" \
-d '{
  "queryStringParameters": {
    "key": "excel-preview-test.xlsx"
  }
}' | jq -r '.body' | base64 --decode > tmp/excel-preview-test.pdf
```
