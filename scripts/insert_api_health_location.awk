BEGIN { inserted = 0 }
{
  if (!inserted && $0 ~ /^    location \/api\//) {
    print "    location = /api/health {"
    print "        proxy_pass http://$core_api_upstream/core/v1/health;"
    print "        proxy_redirect off;"
    print "        proxy_set_header Host $host;"
    print "        proxy_set_header X-Real-IP $remote_addr;"
    print "        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;"
    print "        proxy_set_header X-Forwarded-Proto $proxy_forwarded_proto;"
    print "        proxy_set_header X-Forwarded-Port $proxy_forwarded_port;"
    print "        proxy_set_header X-Forwarded-Host $host;"
    print "        proxy_read_timeout 120s;"
    print "    }"
    print ""
    print "    location = /api/health/ {"
    print "        proxy_pass http://$core_api_upstream/core/v1/health;"
    print "        proxy_redirect off;"
    print "        proxy_set_header Host $host;"
    print "        proxy_set_header X-Real-IP $remote_addr;"
    print "        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;"
    print "        proxy_set_header X-Forwarded-Proto $proxy_forwarded_proto;"
    print "        proxy_set_header X-Forwarded-Port $proxy_forwarded_port;"
    print "        proxy_set_header X-Forwarded-Host $host;"
    print "        proxy_read_timeout 120s;"
    print "    }"
    print ""
    inserted = 1
  }

  print $0
}
