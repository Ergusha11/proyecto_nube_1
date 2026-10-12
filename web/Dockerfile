FROM php:8.3-apache

RUN apt-get update \
 && apt-get install -y --no-install-recommends libpq-dev \
 && docker-php-ext-install pdo_pgsql \
 && rm -rf /var/lib/apt/lists/*

RUN a2enmod headers \
 && mv "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini"

COPY custom.ini        $PHP_INI_DIR/conf.d/zz-custom.ini
COPY 000-default.conf  /etc/apache2/sites-available/000-default.conf
COPY security.conf     /etc/apache2/conf-available/security.conf
RUN a2enconf security

WORKDIR /var/www/html
