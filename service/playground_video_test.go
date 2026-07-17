package service

import (
	"fmt"
	"os"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func initModelColumnsForTest(t *testing.T) {
	t.Helper()

	savedMaster := common.IsMasterNode
	savedPath := common.SQLitePath
	savedMain := common.MainDatabaseType()
	savedLog := common.LogDatabaseType()
	savedDSN, hadDSN := os.LookupEnv("SQL_DSN")

	common.IsMasterNode = false
	common.SQLitePath = fmt.Sprintf(
		"file:%s_init?mode=memory&cache=shared",
		strings.ReplaceAll(t.Name(), "/", "_"),
	)
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	require.NoError(t, os.Setenv("SQL_DSN", "local"))
	require.NoError(t, model.InitDB())

	t.Cleanup(func() {
		common.IsMasterNode = savedMaster
		common.SQLitePath = savedPath
		common.SetDatabaseTypes(savedMain, savedLog)
		if hadDSN {
			require.NoError(t, os.Setenv("SQL_DSN", savedDSN))
		} else {
			require.NoError(t, os.Unsetenv("SQL_DSN"))
		}
	})
}

func setupPlaygroundVideoTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	initModelColumnsForTest(t)

	gin.SetMode(gin.TestMode)

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	model.DB = db
	model.LOG_DB = db

	require.NoError(t, db.AutoMigrate(&model.Ability{}, &model.Model{}))

	t.Cleanup(func() {
		sqlDB, err := db.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
	})

	return db
}

func TestVideoRequestProfile(t *testing.T) {
	assert.Equal(t, VideoProfileHappyHorse, VideoRequestProfile("happyhorse-1.0-t2v"))
	assert.Equal(t, VideoProfileSeedance, VideoRequestProfile("doubao-seedance-1-0-lite-t2v"))
	assert.Equal(t, VideoProfileGeneric, VideoRequestProfile("agnes-video-v2.0"))
	assert.Equal(t, VideoProfileGeneric, VideoRequestProfile("kling-v1"))
}

func TestParseModelTags(t *testing.T) {
	assert.Equal(t, []string{"video", "t2v"}, ParseModelTags(" video, T2V "))
	assert.Nil(t, ParseModelTags(""))
}

func TestModelTagsContain(t *testing.T) {
	assert.True(t, ModelTagsContain("video,t2v", constant.ModelTagT2V))
	assert.False(t, ModelTagsContain("video,i2v", constant.ModelTagT2V))
}

func TestListPlaygroundVideoModels(t *testing.T) {
	db := setupPlaygroundVideoTestDB(t)

	require.NoError(t, db.Create(&[]model.Ability{
		{Group: "default", Model: "happyhorse-1.0-t2v", ChannelId: 1, Enabled: true},
		{Group: "default", Model: "doubao-seedance-1-0-lite-t2v", ChannelId: 2, Enabled: true},
		{Group: "default", Model: "kling-v1", ChannelId: 3, Enabled: true},
		{Group: "default", Model: "happyhorse-no-catalog", ChannelId: 4, Enabled: true},
		{Group: "default", Model: "happyhorse-disabled", ChannelId: 5, Enabled: true},
		{Group: "default", Model: "custom-t2v-model", ChannelId: 6, Enabled: true},
	}).Error)

	now := common.GetTimestamp()
	require.NoError(t, db.Create(&[]model.Model{
		{ModelName: "happyhorse-1.0-t2v", Tags: "t2v", Status: 1, CreatedTime: now, UpdatedTime: now},
		{ModelName: "doubao-seedance-1-0-lite-t2v", Tags: "video,t2v", Status: 1, CreatedTime: now, UpdatedTime: now},
		{ModelName: "kling-v1", Tags: "t2v", Status: 1, CreatedTime: now, UpdatedTime: now},
		{ModelName: "happyhorse-disabled", Tags: "t2v", Status: 1, CreatedTime: now, UpdatedTime: now},
		{ModelName: "custom-t2v-model", Tags: "t2v", Status: 1, CreatedTime: now, UpdatedTime: now},
	}).Error)
	require.NoError(t, db.Model(&model.Model{}).
		Where("model_name = ?", "happyhorse-disabled").
		Update("status", 0).Error)

	models, err := ListPlaygroundVideoModels("default")
	require.NoError(t, err)
	require.Len(t, models, 4)

	names := make([]string, 0, len(models))
	for _, item := range models {
		names = append(names, item.Model)
	}
	assert.ElementsMatch(t, []string{
		"happyhorse-1.0-t2v",
		"doubao-seedance-1-0-lite-t2v",
		"kling-v1",
		"custom-t2v-model",
	}, names)

	for _, item := range models {
		switch item.Model {
		case "happyhorse-1.0-t2v":
			assert.Equal(t, VideoProfileHappyHorse, item.Profile)
		case "doubao-seedance-1-0-lite-t2v":
			assert.Equal(t, VideoProfileSeedance, item.Profile)
		case "kling-v1", "custom-t2v-model":
			assert.Equal(t, VideoProfileGeneric, item.Profile)
		default:
			t.Fatalf("unexpected model %s", item.Model)
		}
	}
}

func TestGetEnabledCatalogModelsByNames(t *testing.T) {
	db := setupPlaygroundVideoTestDB(t)
	now := common.GetTimestamp()
	require.NoError(t, db.Create(&[]model.Model{
		{ModelName: "enabled-model", Tags: "t2v", Status: 1, CreatedTime: now, UpdatedTime: now},
		{ModelName: "disabled-model", Tags: "t2v", Status: 1, CreatedTime: now, UpdatedTime: now},
	}).Error)
	require.NoError(t, db.Model(&model.Model{}).
		Where("model_name = ?", "disabled-model").
		Update("status", 0).Error)

	models, err := model.GetEnabledCatalogModelsByNames([]string{
		"enabled-model",
		"disabled-model",
		"missing-model",
	})
	require.NoError(t, err)
	require.Len(t, models, 1)
	assert.Equal(t, "enabled-model", models[0].ModelName)
}
