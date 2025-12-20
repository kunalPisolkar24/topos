#!/bin/bash

FILE_PATH="./filebeat/filebeat.yml"

echo "This script will set root ownership and secure permissions for filebeat.yml."
echo "------------------------------------------------------------------"

if [ ! -f "$FILE_PATH" ]; then
    echo "ERROR: Cannot find '$FILE_PATH'."
    echo "Please ensure you are running this script from your project's root directory."
    exit 1
fi

echo "You may be prompted for your administrator password to proceed."

sudo chown root:root "$FILE_PATH" && sudo chmod 644 "$FILE_PATH"

if [ $? -eq 0 ]; then
    echo
    echo "SUCCESS! Permissions have been updated correctly."
    echo "Current permissions for filebeat.yml:"
    ls -l "$FILE_PATH"
    echo "------------------------------------------------------------------"
else
    echo
    echo "ERROR: An error occurred while setting permissions. Please review the output above."
    echo "------------------------------------------------------------------"
    exit 1
fi

exit 0