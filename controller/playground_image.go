package controller

import (
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

func GetUserPlaygroundImageModels(c *gin.Context) {
	user, err := model.GetUserCache(c.GetInt("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}

	groups := service.GetUserUsableGroups(user.Group)
	group := c.Query("group")
	if group == "" {
		group = user.Group
	}
	if _, ok := groups[group]; !ok {
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "",
			"data":    []any{},
		})
		return
	}

	models, err := service.ListPlaygroundImageModels(group)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    models,
	})
}
